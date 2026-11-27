// 2.5.0 BİRLEŞİK TUR 3 (birleşik tur 2 dar kontrolü YAN-A, YAN-B, DOĞRULANMADI 3a / 3b; sakınca süzgeci: sessiz veri kaybı) — EKRANDAN, iki kullanıcı:
//   A (yönetici, tarayıcı) formu açar → B (ikinci yönetici, öbür oturum; yeni istemci gibi kendi açtığı sürümle) AYNI kaydı düzeltir → A formda yalnız bir alanı
//   değiştirip Kaydet'e basar. Beklenen (sunucu lib/row-version.mjs + istemci formu): 409 "<…> siz (formu) açtıktan sonra başka biri tarafından …; … kaydedilmedi /
//   yapılmadı" formda görünür, form açık kalır ve kendiliğinden yeniden GÖNDERMEZ (409'dan sonraki 1,5 sn'de o adrese giden yazım isteği tam 1 — A'nın tıklaması);
//   veri tabanında B'nin değeri durur; arkadaki kart / Kasa listesi kendiliğinden yenilenir. Önceden (3360687f) bu formlar sürüm göndermiyordu: kayıt 200, formdaki
//   ESKİ değer B'nin düzeltmesini sessizce geri yazıyordu.
//   E1 Kasa → Açılış Bakiyesi (hof-workspace cashOpeningForm; YAN-A), E2 taksit düzelt (hof-plans editItem; YAN-B), E3 taksit kartı Düzenle (hof-plans editPlan; 3a),
//   E4 stok kartı Düzenle (hof-stock editItem; 3a), E5 stok hareketi "Stok Eksiye Düşecek" onayından SONRA gelen 409 (hof-stock editMove; 3b — onay penceresi açıkken
//   B hareketi düzeltir, A "Yine de Kaydet" der → 409 formda + kart yenilenir). Her adımda GERİLEME: yeniden açılan form B'nin değeriyle dolu, yarışsız düzeltme 200.
//   İnsan hızı + Tab (ders 12): açıklama / not alanları harf harf yazılır. Kapatma sorusu (ders 34): yazılmış formda Esc → "Kaydedilmemiş Değişiklik" BEKLENİR.
//   Saat AKAN sahte saat: sabit saatte iki yazımın damgası (sürüm) aynı olurdu.
// BİRLEŞİK TUR 4 (tur 3 dar kontrolü): E1b / E1c Nakit Kasa'nın varsayılan "Uyar" yolu — "Kasa Eksiye Düşecek" sorusu açıkken B kaydı değiştirir, A "Yine de Kaydet"
//   der → hof-core'un cashForce yeniden gönderimi formun sürümünü taşır, 409 (açılış ve Kasa hareketi düzeltmesi; N6 mutantı). E7 yanıtı kopan KENDİ kaydı (taksit
//   düzelt, taksit kartı, stok kartı): yeniden Kaydet 200, tek yazım ("değişiklik yok" kısa yolu); yanıt koptuktan sonra B farklı değer girerse yine 409.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/senaryo-duzeltme-kilidi-tur3-250.mjs
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";
import { createClock } from "../../server/lib/clock.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-duzeltme-kilidi-tur3-250-"));
const shots = process.env.EKRAN_DIR || root;
const TODAY = "2026-10-20";
const clock = createClock({ time: `${TODAY}T12:00:00+03:00` });
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: clock, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, legacyCasePayments: false, legacyTableTransfer: false });
const api = await server.login();
const db = server.app.store;

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = name => page?.screenshot({ path: path.join(shots, `duzeltme-kilidi-tur3-250-${name}.png`) }).catch(() => null);
const MODAL = ".hof-modal-backdrop.is-visible";
// En üstteki pencere konuma değil sıraya göre (ders 39).
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3)}`);
    await closeAll().catch(() => null);
  }
};
const waitForm = async name => {
  await page.waitForSelector(`${TOP} form [name="${name}"]`);
  await page.waitForTimeout(200);
};
// İnsan hızında yazım (ders 12): alana tıklanır, eski metin silinir, harf harf yazılır, Tab ile çıkılır.
const typeHuman = async (name, text) => {
  await page.click(`${TOP} form [name="${name}"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  for (const ch of text) await page.keyboard.type(ch, { delay: 40 });
  await page.keyboard.press("Tab");
};
const formError = () => page.$eval(`${TOP} .hof-form-error`, node => node.textContent.trim()).catch(() => "");
const fieldValue = name => page.$eval(`${TOP} form [name="${name}"]`, node => node.value).catch(() => "");
// İstekler (zamanıyla): GET okumalar ve yazımlar (PUT / POST).
const reads = [];
const writes = [];
const readAfter = async (pattern, since, timeout = 6000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (reads.some(item => item.at > since && pattern.test(item.url))) return true;
    await sleep(100);
  }
  return false;
};
const settle = async (pattern, quiet = 2500, timeout = 15000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const last = reads.filter(item => pattern.test(item.url)).at(-1)?.at || 0;
    if (Date.now() - Math.max(last, start) >= quiet) return Date.now() - start;
    await sleep(100);
  }
  return -1;
};
// Kaydet (ya da onaydaki "Yine de Kaydet") tıklanır, o adrese giden yazımın yanıtı okunur (reddedilen istek başarı değildir — ders 3).
const clickAndRead = async (selector, urlPart, method) => {
  const clickAt = Date.now();
  const [response] = await Promise.all([page.waitForResponse(res => res.url().includes(urlPart) && res.request().method() === method, { timeout: 15000 }), page.click(selector)]);
  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }
  return { status: response.status(), code: body?.code || "", body, clickAt };
};
// DÜŞÜK-3 dişi: 409'dan sonraki 1,5 sn'de o adrese giden yazım isteği sayısı (tıklamadan bu yana; beklenen 1 — kendiliğinden yeniden gönderme yok).
const writesSince = async (urlPart, method, since) => {
  await sleep(1500);
  return writes.filter(item => item.at >= since && item.method === method && item.url.includes(urlPart)).length;
};

// ---------- Veri (programın kendi uçları) ----------
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
await must("ikinci yönetici", api.post("/api/admin/users", { username: "yonetici2", name: "Yönetici İki", role: "admin", password: "Yonetici-Iki-2026!", mustChangePassword: false }));
const other = await server.login("yonetici2", "Yonetici-Iki-2026!");
await must("Kasa açılışı", api.post("/api/workspace/cash/opening", { amount: "5.000", date: day(-30) }));
const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Tur3 Müşteri", phone: "0532 250 00 31", type: "customer", registeredOn: day(-60) }));
const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: customer.id, name: "Tur3 Kartı", total: "1000", mode: "auto", count: 2, firstDue: day(10), registeredOn: day(-5) }));
const item = await must("ürün", api.post("/api/workspace/stock", { code: "T3-1", name: "Tur3 Ürün", unit: "Adet", unitPrice: "10", salePrice: "15", openingQty: "20" }));
const move = await must("stok çıkışı", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "15", pay: "none", date: day(-2), note: "ilk not" }));
const opening = () => db.get("SELECT id, amount, date, updated_at AS updatedAt FROM cash_entries WHERE is_opening = 1");
const userId = name => db.get("SELECT id FROM users WHERE username = ?", name)?.id;
const B = userId("yonetici2");
const STALE = /siz (formu )?açtıktan sonra başka biri tarafından (girildi, )?değiştirildi/;

const browser = await chromium.launch();
const errors = [];
try {
  ok(Boolean(opening()?.id && plan.items?.length === 2 && item.id && move.moveId), "ön koşul: açılış, kart (2 taksit), ürün ve hareket açıldı");
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (!request.url().includes("/api/workspace/")) return;
    const url = new URL(request.url());
    const entry = { url: url.pathname + url.search, at: Date.now(), method: request.method() };
    if (request.method() === "GET") reads.push(entry);
    else writes.push(entry);
  });
  await installPageClock(page, clock);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.stock?.open && window.HOF?.plans?.open), null, { timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem(`hof-notices-off:${window.HOF.user.id}`, "1");
    document.querySelectorAll("#hof-notices .hof-notice").forEach(node => node.remove());
  });
  await page.waitForTimeout(600);

  const STK = `${MODAL} .hof-stock-modal`;
  const PLN = `${MODAL} .hof-plans-modal:not(.hof-accounts-modal):not(.hof-stock-modal)`;
  const CASH = `${MODAL}:has(.hof-cash-list)`;
  const openPlan = async () => {
    await page.evaluate(id => window.HOF.plans.open(id), plan.id);
    await page.waitForSelector(`${PLN} [data-edit-item="${plan.items[0].id}"]`);
    await page.waitForTimeout(300);
  };
  const openStock = async () => {
    await page.evaluate(id => window.HOF.stock.open(id), item.id);
    await page.waitForSelector(`${STK} [data-edit-move="${move.moveId}"]`);
    await page.waitForTimeout(300);
  };
  const openCash = async () => {
    await page.click('#hof-sidecard [data-action="cash"]');
    await page.waitForSelector(`${CASH} [data-opening]`, { timeout: 15000 });
    await page.waitForTimeout(500);
  };
  const planRead = new RegExp(`^/api/workspace/plans/${plan.id}(\\?|$)`);
  const stockRead = new RegExp(`^/api/workspace/stock/${item.id}(\\?|$)`);
  const cashRead = /^\/api\/workspace\/cash\?from=/;
  // Ön koşul (ders 20): B'nin yazımının canlı yenilemesi (varsa) A Kaydet'e basmadan biter; 409'dan sonraki okuma formun kendi yenilemesidir.
  const calm = async (pattern, since) => {
    const live = await readAfter(pattern, since, 5000);
    const quiet = await settle(pattern);
    console.log(`    (ön koşul: B'nin yazımından sonra canlı yenileme ${live ? "geldi" : "gelmedi"}; okumalar ${quiet >= 0 ? `${quiet} ms'de duruldu` : "DURULMADI"})`);
  };
  // 409 sonrası ortak denetimler.
  const after409 = async ({ label, res, urlPart, method, readPattern, field, dbCheck, dbText }) => {
    const message = await formError();
    ok(res.status === 409 && /-stale$/.test(res.code), `${label}: A'nın eskimiş formu 409 aldı (${res.status} ${res.code})`);
    ok(STALE.test(message), `${label}: ileti formda: “${message}”`);
    ok(Boolean(await page.$(`${TOP} form [name="${field}"]`)), `${label}: form açık kaldı`);
    const count = await writesSince(urlPart, method, res.clickAt);
    ok(count === 1, `${label}: 409'dan sonra kendiliğinden yeniden göndermedi (1,5 sn'de ${method} ${urlPart}: ${count}; beklenen 1)`);
    ok(dbCheck(), `${label}: veri tabanında B'nin değeri duruyor, A'nınki yazılmadı (${dbText()})`);
    const self = await readAfter(readPattern, res.clickAt);
    if (!self) console.log(`    (409'dan sonraki okumalar: ${JSON.stringify(reads.filter(r => r.at > res.clickAt).map(r => r.url).slice(0, 12))})`);
    ok(self, `${label}: 409'dan sonra form arkadaki ${readPattern === cashRead ? "Kasa listesini" : "kartı"} kendisi yeniden okudu (${readPattern.source})`);
    await shot(`${label.slice(0, 14).replace(/[^\w]+/g, "-")}-409`);
  };

  await step("E1 Kasa → Açılış Bakiyesi (hof-workspace cashOpeningForm; YAN-A)", async () => {
    await openCash();
    await page.click(`${CASH} [data-opening]`);
    await waitForm("amount");
    ok(/^5\.000(,00)?$/.test(await fieldValue("amount")), `form 5.000 ile açıldı (${await fieldValue("amount")})`);
    const bAt = Date.now();
    await sleep(5);
    const state = await must("B formu açar", other.get("/api/workspace/cash/opening"));
    const bRes = await other.post("/api/workspace/cash/opening", { amount: "4.000", date: state.opening.date, openingId: state.opening.id, updatedAt: state.opening.updatedAt });
    ok(bRes.status === 200 && opening().amount === 4000, `B açılışı 4.000 yaptı → ${bRes.status} (${opening().amount})`);
    await calm(cashRead, bAt);
    // A yalnız tarihi değiştirir (tutar alanında formun açıldığı andaki 5.000 durur).
    // Klavyeyle (ders 12; programın "dokunuldu" izi yalnız gerçek olaylarla): tarih alanına odaklanılır, odaklanan bölüm (Chromium tr-TR'de ay) ↓ ile bir geri
    // alınır, Tab. Tarih geçmişe gider (Kasa'nın ilk hareketinden önce; kural dışı değil).
    await page.focus(`${TOP} form [name="date"]`);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    const typed = await fieldValue("date");
    ok(/^\d{4}-\d{2}-\d{2}$/.test(typed) && typed < day(-30), `A yalnız tarihi değiştirdi (${day(-30)} → ${typed})`);
    const res = await clickAndRead(`${TOP} form button[type="submit"]`, "/api/workspace/cash/opening", "POST");
    await after409({ label: "Açılış", res, urlPart: "/api/workspace/cash/opening", method: "POST", readPattern: cashRead, field: "amount", dbCheck: () => opening().amount === 4000 && opening().date === day(-30), dbText: () => JSON.stringify({ amount: opening().amount, date: opening().date }) });
    await escClose(page, { expect: "soru-var", step: "E1 409 sonrası form kapatılıyor (tarih değiştirildi)" });
    await page.waitForTimeout(300);
    // Gerileme: yeniden açılan form B'nin değeriyle; yarışsız düzeltme 200, hemen ardından ikinci düzeltme de 200.
    await page.click(`${CASH} [data-opening]`);
    await waitForm("amount");
    ok(/^4\.000(,00)?$/.test(await fieldValue("amount")), `yeniden açılan form B'nin 4.000'iyle dolu (${await fieldValue("amount")})`);
    await typeHuman("amount", "4.250");
    const again = await clickAndRead(`${TOP} form button[type="submit"]`, "/api/workspace/cash/opening", "POST");
    ok(again.status === 200 && opening().amount === 4250, `yarışsız düzeltme kaydedildi (${again.status} ${again.code}; ${opening().amount})`);
    await page.waitForSelector(`${TOP} form [name="amount"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(800);
    await page.click(`${CASH} [data-opening]`);
    await waitForm("amount");
    await typeHuman("amount", "4.300");
    const third = await clickAndRead(`${TOP} form button[type="submit"]`, "/api/workspace/cash/opening", "POST");
    ok(third.status === 200 && opening().amount === 4300, `ardışık ikinci düzeltme de kaydedildi (${third.status} ${third.code}; ${opening().amount})`);
    ok(opening().updatedAt && db.get("SELECT updated_by AS u FROM cash_entries WHERE is_opening = 1").u !== B, "son düzeltme A'nın");
    await closeAll();
  });

  // BİRLEŞİK TUR 4 (tur 3 dar kontrolü DÜŞÜK-1 → süzgeçle ORTA, yalnız test): Nakit Kasa'nın varsayılan "Uyar" yolu. Düşüren düzeltme önce "Kasa Eksiye Düşecek"
  // sorusunu açar; soru açıkken B kaydı değiştirir; A "Yine de Kaydet" der. hof-core.js HOF.api aynı gövdeyi cashForce ile YENİDEN gönderir — o gönderim formun
  // açıldığı andaki sürümü (updatedAt; açılışta openingId de) TAŞIMALI, yoksa B'nin değeri ezilir ve Kasa eksiye düşer (N6 mutantı tur 3 e2e'sinde yaşadı).
  const cashOut = () => db.get("SELECT id, amount, description, updated_by AS by FROM cash_entries WHERE description = 'Tur4 Kira'");
  const cashBalance = async () => (await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash;
  const askAndForce = async ({ label, urlPart, method, during }) => {
    const first = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, method);
    ok(first.status === 409 && first.code === "cash-negative", `${label}: ilk gönderim Kasa sorusu (409 ${first.code}: ${String(first.body?.error || "").slice(0, 90)})`);
    const confirmSel = `${TOP} [data-answer="yes"]`;
    const asked = await page
      .waitForSelector(confirmSel, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const title = await page.$eval(`${TOP} .hof-modal-title, ${TOP} h2`, node => node.textContent.trim()).catch(() => "");
    ok(asked && /Kasa Eksiye Düşecek/.test(title), `${label}: “Kasa Eksiye Düşecek” sorusu açık (“${title}”)`);
    const bAt = Date.now();
    await sleep(5);
    await during();
    await calm(cashRead, bAt);
    const res = await clickAndRead(confirmSel, urlPart, method);
    await page.waitForTimeout(300);
    return res;
  };

  await step("E1b Kasa açılışı Uyar: soru açıkken B açılışı değiştirir, A 'Yine de Kaydet' (hof-core cashForce yeniden gönderimi; U1)", async () => {
    await must("Kasa ödemesi (ön koşul)", api.post("/api/workspace/cash", { kind: "out", amount: "4.000", date: day(-1), description: "Tur4 Kira" }));
    const before = await cashBalance();
    ok(Math.abs(before - 300) < 0.005 && opening().amount === 4300, `ön koşul: açılış 4.300, Kasa nakit 300 (${opening().amount}; ${before})`);
    await openCash();
    await page.click(`${CASH} [data-opening]`);
    await waitForm("amount");
    await typeHuman("amount", "1.000");
    const res = await askAndForce({
      label: "Açılış Uyar",
      urlPart: "/api/workspace/cash/opening",
      method: "POST",
      during: async () => {
        const state = await must("B formu açar", other.get("/api/workspace/cash/opening"));
        const bRes = await other.post("/api/workspace/cash/opening", { amount: "6.000", date: state.opening.date, openingId: state.opening.id, updatedAt: state.opening.updatedAt });
        ok(bRes.status === 200 && opening().amount === 6000, `B açılışı 6.000 yaptı → ${bRes.status} (${opening().amount})`);
      },
    });
    await after409({ label: "Açılış Uyar", res, urlPart: "/api/workspace/cash/opening", method: "POST", readPattern: cashRead, field: "amount", dbCheck: () => opening().amount === 6000 && db.get("SELECT updated_by AS u FROM cash_entries WHERE is_opening = 1").u === B, dbText: () => JSON.stringify({ amount: opening().amount }) });
    ok(res.code === "cash-opening-stale", `Açılış Uyar: kod cash-opening-stale (${res.code})`);
    const afterBalance = await cashBalance();
    ok(Math.abs(afterBalance - 2000) < 0.005, `Açılış Uyar: Kasa eksiye düşmedi — nakit 2.000 (B'nin 6.000'i − 4.000; gelen ${afterBalance})`);
    await escClose(page, { expect: "soru-var", step: "E1b 409 sonrası form kapatılıyor (tutar yazıldı)" });
    await closeAll();
  });

  await step("E1c Kasa hareketi düzelt Uyar: soru açıkken B ödemeyi düzeltir, A 'Yine de Kaydet' (hof-workspace editCashEntry; aynı yeniden gönderim)", async () => {
    const target = cashOut();
    ok(Boolean(target?.id) && target.amount === 4000, `ön koşul: Kasa ödemesi 4.000 (${JSON.stringify(target)})`);
    await openCash();
    await page.click(`${CASH} [data-edit="${target.id}"]`);
    await waitForm("amount");
    await typeHuman("amount", "9.000");
    const urlPart = `/api/workspace/cash/${target.id}`;
    const res = await askAndForce({
      label: "Kasa hareketi Uyar",
      urlPart,
      method: "PUT",
      during: async () => {
        const list = await must("B Kasa listesini okur", other.get(`/api/workspace/cash?from=${day(-60)}&to=${day(0)}`));
        const fresh = (list.entries || list.items || list.rows || []).find(entry => entry.id === target.id);
        ok(Boolean(fresh), `B hareketi listede gördü (${fresh ? fresh.updatedAt || "sürüm boş" : "yok"})`);
        const bRes = await other.put(urlPart, { kind: "out", amount: "4.100", date: day(-1), description: "Tur4 Kira", updatedAt: fresh?.updatedAt || "" });
        ok(bRes.status === 200 && cashOut().amount === 4100 && cashOut().by === B, `B ödemeyi 4.100 yaptı → ${bRes.status} ${bRes.data?.error || ""}`);
      },
    });
    await after409({ label: "Kasa hareketi Uyar", res, urlPart, method: "PUT", readPattern: cashRead, field: "amount", dbCheck: () => cashOut().amount === 4100 && cashOut().by === B, dbText: () => JSON.stringify(cashOut()) });
    ok(res.code === "cash-entry-stale", `Kasa hareketi Uyar: kod cash-entry-stale (${res.code})`);
    const afterBalance = await cashBalance();
    ok(Math.abs(afterBalance - 1900) < 0.005, `Kasa hareketi Uyar: Kasa eksiye düşmedi — nakit 1.900 (6.000 − B'nin 4.100'ü; gelen ${afterBalance})`);
    await escClose(page, { expect: "soru-var", step: "E1c 409 sonrası form kapatılıyor (tutar yazıldı)" });
    await closeAll();
  });

  await step("E2 Taksit düzelt (hof-plans editItem; YAN-B)", async () => {
    const target = plan.items[0];
    const row = () => db.get("SELECT amount, due_date AS dueDate, note FROM plan_items WHERE id = ?", target.id);
    await openPlan();
    await page.click(`${PLN} [data-edit-item="${target.id}"]`);
    await waitForm("note");
    const bAt = Date.now();
    await sleep(5);
    const fresh = (await must("B kartı okur", other.get(`/api/workspace/plans/${plan.id}`))).items.find(entry => entry.id === target.id);
    const bRes = await other.put(`/api/workspace/plans/${plan.id}/items/${target.id}`, { dueDate: fresh.dueDate, amount: "300", note: "", updatedAt: fresh.updatedAt });
    ok(bRes.status === 200 && row().amount === 300, `B taksiti 300 yaptı → ${bRes.status}`);
    await calm(planRead, bAt);
    await typeHuman("note", "A'nın notu");
    const urlPart = `/plans/${plan.id}/items/${target.id}`;
    const res = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    await after409({ label: "Taksit", res, urlPart, method: "PUT", readPattern: planRead, field: "note", dbCheck: () => row().amount === 300 && row().note === "", dbText: () => JSON.stringify(row()) });
    const shown = await page
      .waitForFunction(sel => /300,00/.test(document.querySelector(sel)?.closest("tr")?.innerText || ""), `${PLN} [data-edit-item="${target.id}"]`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    ok(shown, "arkadaki kart B'nin 300'üne yenilendi");
    await escClose(page, { expect: "soru-var", step: "E2 409 sonrası form kapatılıyor (not yazıldı)" });
    await page.waitForTimeout(300);
    await page.click(`${PLN} [data-edit-item="${target.id}"]`);
    await waitForm("note");
    ok(/^300(,00)?$/.test(await fieldValue("amount")), `yeniden açılan form B'nin 300'üyle dolu (${await fieldValue("amount")})`);
    await typeHuman("note", "A yeniden");
    const again = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(again.status === 200 && row().note === "A yeniden" && row().amount === 300, `yarışsız düzeltme kaydedildi (${again.status} ${JSON.stringify(row())})`);
    await page.waitForSelector(`${TOP} form [name="note"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(500);
    await page.click(`${PLN} [data-edit-item="${target.id}"]`);
    await waitForm("note");
    await typeHuman("note", "A ikinci");
    const third = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(third.status === 200 && row().note === "A ikinci", `ardışık ikinci düzeltme de kaydedildi (${third.status} ${third.code})`);
    await closeAll();
  });

  await step("E3 Taksit kartı Düzenle (hof-plans editPlan; 3a)", async () => {
    const row = () => db.get("SELECT total, note FROM plans WHERE id = ?", plan.id);
    await openPlan();
    await page.click(`${PLN} [data-act="edit"]`);
    await waitForm("note");
    const bAt = Date.now();
    await sleep(5);
    const fresh = await must("B kartı okur", other.get(`/api/workspace/plans/${plan.id}`));
    const bRes = await other.put(`/api/workspace/plans/${plan.id}`, { name: fresh.name, refNo: fresh.refNo, registeredOn: fresh.registeredOn, phone: fresh.phone || "", total: "1200", note: fresh.note || "", accountId: fresh.accountId, updatedAt: fresh.updatedAt });
    ok(bRes.status === 200 && row().total === 1200, `B kartın tutarını 1.200 yaptı → ${bRes.status} ${bRes.data?.error || ""}`);
    await calm(planRead, bAt);
    await typeHuman("note", "A'nın kart notu");
    const urlPart = `/api/workspace/plans/${plan.id}`;
    const res = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    await after409({ label: "Kart", res, urlPart, method: "PUT", readPattern: planRead, field: "note", dbCheck: () => row().total === 1200 && !row().note, dbText: () => JSON.stringify(row()) });
    await escClose(page, { expect: "soru-var", step: "E3 409 sonrası form kapatılıyor (not yazıldı)" });
    await page.waitForTimeout(300);
    await page.click(`${PLN} [data-act="edit"]`);
    await waitForm("note");
    ok(/^1\.200(,00)?$/.test(await fieldValue("total")), `yeniden açılan form B'nin 1.200'üyle dolu (${await fieldValue("total")})`);
    await typeHuman("note", "A yeniden");
    const again = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(again.status === 200 && row().note === "A yeniden" && row().total === 1200, `yarışsız düzeltme kaydedildi (${again.status} ${JSON.stringify(row())})`);
    await page.waitForSelector(`${TOP} form [name="note"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(500);
    await page.click(`${PLN} [data-act="edit"]`);
    await waitForm("note");
    await typeHuman("note", "A ikinci");
    const third = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(third.status === 200 && row().note === "A ikinci", `ardışık ikinci düzeltme de kaydedildi (${third.status} ${third.code})`);
    await closeAll();
  });

  await step("E4 Stok kartı Düzenle (hof-stock editItem; 3a)", async () => {
    const row = () => db.get("SELECT sale_price AS salePrice, note FROM stock_items WHERE id = ?", item.id);
    await openStock();
    await page.click(`${STK} [data-act="edit"]`);
    await waitForm("note");
    const bAt = Date.now();
    await sleep(5);
    const fresh = await must("B kartı okur", other.get(`/api/workspace/stock/${item.id}`));
    const bRes = await other.put(`/api/workspace/stock/${item.id}`, { kind: fresh.kind, code: fresh.code, name: fresh.name, unit: fresh.unit, category: fresh.category || "", minQty: "", unitPrice: String(fresh.unitPrice), salePrice: "20", vatRate: "", note: fresh.note || "", updatedAt: fresh.updatedAt });
    ok(bRes.status === 200 && row().salePrice === 20, `B Satış Fiyatı'nı 20 yaptı → ${bRes.status} ${bRes.data?.error || ""}`);
    await calm(stockRead, bAt);
    await typeHuman("note", "A'nın ürün notu");
    const urlPart = `/api/workspace/stock/${item.id}`;
    const res = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    await after409({ label: "Stok kartı", res, urlPart, method: "PUT", readPattern: stockRead, field: "note", dbCheck: () => row().salePrice === 20 && !row().note, dbText: () => JSON.stringify(row()) });
    await escClose(page, { expect: "soru-var", step: "E4 409 sonrası form kapatılıyor (not yazıldı)" });
    await page.waitForTimeout(300);
    await page.click(`${STK} [data-act="edit"]`);
    await waitForm("note");
    ok(/^20(,00)?$/.test(await fieldValue("salePrice")), `yeniden açılan form B'nin 20'siyle dolu (${await fieldValue("salePrice")})`);
    await typeHuman("note", "A yeniden");
    const again = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(again.status === 200 && row().note === "A yeniden" && row().salePrice === 20, `yarışsız düzeltme kaydedildi (${again.status} ${JSON.stringify(row())})`);
    await page.waitForSelector(`${TOP} form [name="note"]`, { state: "detached", timeout: 8000 }).catch(() => null);
    await page.waitForTimeout(500);
    await page.click(`${STK} [data-act="edit"]`);
    await waitForm("note");
    await typeHuman("note", "A ikinci");
    const third = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(third.status === 200 && row().note === "A ikinci", `ardışık ikinci düzeltme de kaydedildi (${third.status} ${third.code})`);
    await closeAll();
  });

  await step("E5 Stok hareketi: 'Stok Eksiye Düşecek' onayı açıkken B hareketi düzeltir, A 'Yine de Kaydet' der (hof-stock editMove; 3b)", async () => {
    const row = () => db.get("SELECT qty, note, updated_by AS by FROM stock_moves WHERE id = ?", move.moveId);
    await openStock();
    await page.click(`${STK} [data-edit-move="${move.moveId}"]`);
    await waitForm("qty");
    await typeHuman("qty", "50");
    const urlPart = `/moves/${move.moveId}`;
    const first = await clickAndRead(`${TOP} form button[type="submit"]`, urlPart, "PUT");
    ok(first.status === 409 && /eksiye/.test(String(first.body?.error || "")), `ön koşul: ilk gönderim eksi stok sorusu (409 ${first.code}: ${String(first.body?.error || "").slice(0, 80)})`);
    const confirmSel = `${TOP} [data-answer="yes"]`;
    const asked = await page
      .waitForSelector(confirmSel, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    ok(asked, "\"Stok Eksiye Düşecek\" onay penceresi açıldı");
    const title = await page.$eval(`${TOP} .hof-modal-title, ${TOP} h2`, node => node.textContent.trim()).catch(() => "");
    ok(/Stok Eksiye Düşecek/.test(title), `onay başlığı: “${title}”`);
    const bAt = Date.now();
    await sleep(5);
    const fresh = (await must("B kartı okur", other.get(`/api/workspace/stock/${item.id}`))).moves.find(entry => entry.id === move.moveId);
    const bRes = await other.put(`/api/workspace/stock/${item.id}/moves/${move.moveId}`, { qty: "2", updatedAt: fresh.updatedAt || "" });
    ok(bRes.status === 200 && row().qty === 2 && row().by === B, `B hareketi 2 adede düzeltti → ${bRes.status} ${bRes.data?.error || ""}`);
    await calm(stockRead, bAt);
    const res = await clickAndRead(confirmSel, urlPart, "PUT");
    await page.waitForTimeout(300);
    await after409({ label: "Eksi stok onayı", res, urlPart, method: "PUT", readPattern: stockRead, field: "qty", dbCheck: () => row().qty === 2 && row().by === B, dbText: () => JSON.stringify(row()) });
    const shown = await page
      .waitForFunction(sel => /\b2\b/.test(document.querySelector(sel)?.closest("tr")?.innerText || ""), `${STK} [data-edit-move="${move.moveId}"]`, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    ok(shown, "arkadaki kart B'nin 2 adedine yenilendi");
    await escClose(page, { expect: "soru-var", step: "E5 409 sonrası form kapatılıyor (miktar yazıldı)" });
    await closeAll();
  });

  // BİRLEŞİK TUR 4 (tur 3 dar kontrolü ORTA-1, gerileme): yanıtı kopan KENDİ kaydı. Kaydet'in isteği sunucuya ulaşır ve yazılır, yanıt yolda kopar (route.fetch +
  // abort); form "Sunucuya ulaşılamadı" der ve açık kalır; kullanıcı aynı formda yeniden Kaydet'e basar (aynı gövde, formun eski sürümü). Beklenen: 200, form kapanır,
  // "kaydedilmedi" iletisi YOK; veri tabanında tek yazım (Değişiklik Geçmişi'nde tek kayıt, ikinci gönderimde sürüm ilerlemez). Tur 3 kodunda (ccbf7812) ikinci gönderim
  // 409 "değişikliğiniz kaydedilmedi" alıyordu (kaydedilmişti). Koruma bozulmaz: yanıt koptuktan sonra B FARKLI bir değer girerse A'nın yeniden gönderimi yine 409.
  const audits = (type, ref) => db.get("SELECT COUNT(*) AS n FROM audit_events WHERE type = ? AND entity_id = ?", type, ref)?.n ?? -1;
  // Kaydet → istek sunucuya gider, yanıt koparılır; dönen: formdaki ileti ve o adrese giden yazım sayısı.
  const dropResponse = async (pathname, method) => {
    let dropped = 0;
    const match = u => u.pathname === pathname;
    await page.route(match, async route => {
      if (route.request().method() === method && dropped === 0) {
        dropped += 1;
        await route.fetch();
        return route.abort("connectionreset");
      }
      return route.continue();
    });
    const at = Date.now();
    await page.click(`${TOP} form button[type="submit"]`);
    let message = "";
    for (let index = 0; index < 60 && !message; index += 1) {
      await sleep(100);
      message = await formError();
    }
    await page.unroute(match);
    return { message, dropped, at };
  };
  const retryOwn = async ({ label, pathname, field, audit, version, value }) => {
    const lost = await dropResponse(pathname, "PUT");
    ok(lost.dropped === 1 && /Sunucuya ulaşılamadı/.test(lost.message), `${label}: 1. Kaydet sunucuya ulaştı, yanıt koptu — ileti “${lost.message}”`);
    ok(value(), `${label}: veri tabanında A'nın değeri yazıldı (yanıt kopmuş olsa da)`);
    const auditsAfterFirst = audit();
    const versionAfterFirst = version();
    ok(Boolean(await page.$(`${TOP} form [name="${field}"]`)), `${label}: form açık kaldı`);
    const again = await clickAndRead(`${TOP} form button[type="submit"]`, pathname, "PUT");
    const closed = await page
      .waitForSelector(`${TOP} form [name="${field}"]`, { state: "detached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    const message = closed ? "" : await formError();
    ok(again.status === 200 && closed && !STALE.test(message), `${label}: aynı formda yeniden Kaydet 200, form kapandı, “kaydedilmedi” iletisi yok (${again.status} ${again.code}; ileti “${message}”)`);
    const count = await writesSince(pathname, "PUT", again.clickAt);
    ok(count === 1, `${label}: yeniden Kaydet tek istek (1,5 sn'de ${count})`);
    ok(audit() === auditsAfterFirst && version() === versionAfterFirst && value(), `${label}: veri tabanında tek yazım — Değişiklik Geçmişi ${auditsAfterFirst} → ${audit()}, sürüm ${versionAfterFirst} → ${version()}`);
    await page.waitForTimeout(500);
  };

  await step("E7a Yanıtı kopan kendi kaydı: taksit düzelt — yeniden Kaydet 200, tek yazım", async () => {
    const target = plan.items[1];
    const itemRow = () => db.get("SELECT amount, note, updated_at AS updatedAt FROM plan_items WHERE id = ?", target.id);
    await openPlan();
    await page.click(`${PLN} [data-edit-item="${target.id}"]`);
    await waitForm("note");
    await typeHuman("note", "Kopan yanıt taksit");
    const itemAudits0 = audits("plan.item.updated", target.id);
    await retryOwn({ label: "Taksit", pathname: `/api/workspace/plans/${plan.id}/items/${target.id}`, field: "note", audit: () => audits("plan.item.updated", target.id), version: () => itemRow().updatedAt, value: () => itemRow().note === "Kopan yanıt taksit" });
    ok(audits("plan.item.updated", target.id) === itemAudits0 + 1, `Taksit: toplam tek düzeltme kaydı (${itemAudits0} → ${audits("plan.item.updated", target.id)})`);
    await closeAll();
  });

  await step("E7b Yanıtı kopan kendi kaydı: taksit kartı Düzenle — yeniden Kaydet 200, tek yazım", async () => {
    const planRow = () => db.get("SELECT note, total, updated_at AS updatedAt FROM plans WHERE id = ?", plan.id);
    await openPlan();
    await page.click(`${PLN} [data-act="edit"]`);
    await waitForm("note");
    await typeHuman("note", "Kopan yanıt kart");
    await retryOwn({ label: "Kart", pathname: `/api/workspace/plans/${plan.id}`, field: "note", audit: () => audits("plan.updated", plan.id), version: () => planRow().updatedAt, value: () => planRow().note === "Kopan yanıt kart" });
    await closeAll();
  });

  await step("E7c Yanıtı kopan kendi kaydı: stok kartı Düzenle — yeniden Kaydet 200, tek yazım", async () => {
    const stockRow = () => db.get("SELECT sale_price AS salePrice, note, updated_at AS updatedAt, updated_by AS by FROM stock_items WHERE id = ?", item.id);
    await openStock();
    await page.click(`${STK} [data-act="edit"]`);
    await waitForm("note");
    await typeHuman("salePrice", "21");
    await retryOwn({ label: "Stok kartı", pathname: `/api/workspace/stock/${item.id}`, field: "note", audit: () => audits("stock.item.updated", item.id), version: () => stockRow().updatedAt, value: () => stockRow().salePrice === 21 });
    await closeAll();
  });

  await step("E7d Yanıtı kopan kayıttan sonra B farklı değer girer — A'nın yeniden gönderimi yine 409 (koruma bozulmaz)", async () => {
    const stockRow = () => db.get("SELECT sale_price AS salePrice, note, updated_at AS updatedAt, updated_by AS by FROM stock_items WHERE id = ?", item.id);
    await openStock();
    // Koruma bozulmaz: yanıt koptu, ardından B Satış Fiyatı'nı FARKLI bir değere (24) çeker; A'nın aynı formdan yeniden gönderimi (22) 409, B'nin 24'ü durur.
    await page.click(`${STK} [data-act="edit"]`);
    await waitForm("note");
    await typeHuman("salePrice", "22");
    const pathname = `/api/workspace/stock/${item.id}`;
    const lost = await dropResponse(pathname, "PUT");
    ok(/Sunucuya ulaşılamadı/.test(lost.message) && stockRow().salePrice === 22, `Stok kartı (B arada): 1. Kaydet yazıldı, yanıt koptu (${stockRow().salePrice}; “${lost.message}”)`);
    const bAt = Date.now();
    await sleep(5);
    const fresh = await must("B kartı okur", other.get(pathname));
    const bRes = await other.put(pathname, { kind: fresh.kind, code: fresh.code, name: fresh.name, unit: fresh.unit, category: fresh.category || "", minQty: "", unitPrice: String(fresh.unitPrice), salePrice: "24", vatRate: "", note: fresh.note || "", updatedAt: fresh.updatedAt });
    ok(bRes.status === 200 && stockRow().salePrice === 24 && stockRow().by === B, `B Satış Fiyatı'nı 24 yaptı → ${bRes.status} ${bRes.data?.error || ""}`);
    await calm(stockRead, bAt);
    const res = await clickAndRead(`${TOP} form button[type="submit"]`, pathname, "PUT");
    await after409({ label: "Stok kartı (B arada)", res, urlPart: pathname, method: "PUT", readPattern: stockRead, field: "note", dbCheck: () => stockRow().salePrice === 24 && stockRow().by === B, dbText: () => JSON.stringify(stockRow()) });
    await escClose(page, { expect: "soru-var", step: "E7 409 sonrası form kapatılıyor (fiyat yazıldı)" });
    await closeAll();
  });

  await step("E6 Mutabakat Testi", async () => {
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, `Mutabakat Testi ok (${JSON.stringify((integrity.failures || []).slice(0, 3))})`);
  });
} catch (error) {
  ok(false, `senaryo yarıda kaldı: ${String(error?.stack || error).split("\n").slice(0, 3).join(" ")}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
